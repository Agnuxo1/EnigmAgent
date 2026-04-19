package com.enigmagent.vault.ui

import com.enigmagent.vault.client.VaultClient
import com.enigmagent.vault.client.VaultEntry
import com.enigmagent.vault.settings.EnigmAgentSettings
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.JBColor
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBList
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.content.ContentFactory
import java.awt.BorderLayout
import java.awt.FlowLayout
import java.awt.datatransfer.StringSelection
import javax.swing.*

class EnigmAgentToolWindowFactory : ToolWindowFactory {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = EnigmAgentPanel(project)
        val content = ContentFactory.getInstance()
            .createContent(panel.root, "", false)
        toolWindow.contentManager.addContent(content)
    }
}

class EnigmAgentPanel(private val project: Project) {

    val root = JPanel(BorderLayout(4, 4))

    // ── Status bar ────────────────────────────────────────────────────────
    private val statusLabel = JBLabel("● Checking vault...").apply {
        border = BorderFactory.createEmptyBorder(4, 8, 4, 8)
    }

    // ── Secret list ───────────────────────────────────────────────────────
    private val secretListModel = DefaultListModel<VaultEntry>()
    private val secretList = JBList(secretListModel).apply {
        cellRenderer = SecretCellRenderer()
        selectionMode = ListSelectionModel.SINGLE_SELECTION
        toolTipText   = "Double-click or press Enter to copy {{PLACEHOLDER}} to clipboard"
    }

    // ── Buttons ───────────────────────────────────────────────────────────
    private val refreshBtn = JButton("⟳ Refresh").apply {
        toolTipText = "Reload vault status and secret list"
    }
    private val copyBtn = JButton("Copy {{…}}").apply {
        toolTipText = "Copy selected secret as {{PLACEHOLDER}} reference"
        isEnabled   = false
    }

    init {
        buildUI()
        refresh()

        refreshBtn.addActionListener { refresh() }
        copyBtn.addActionListener    { copySelected() }
        secretList.addListSelectionListener { copyBtn.isEnabled = !secretList.isSelectionEmpty }
        secretList.addMouseListener(object : java.awt.event.MouseAdapter() {
            override fun mouseClicked(e: java.awt.event.MouseEvent) {
                if (e.clickCount == 2) copySelected()
            }
        })
    }

    private fun buildUI() {
        // Top: status + buttons
        val topPanel = JPanel(BorderLayout()).apply {
            add(statusLabel, BorderLayout.CENTER)
            val btnPanel = JPanel(FlowLayout(FlowLayout.RIGHT, 4, 0))
            btnPanel.add(copyBtn)
            btnPanel.add(refreshBtn)
            add(btnPanel, BorderLayout.EAST)
        }

        // Center: secret list
        val scrollPane = JBScrollPane(secretList).apply {
            border = BorderFactory.createTitledBorder("Secrets (names only — never values)")
        }

        // Bottom: hint
        val hintLabel = JBLabel(
            "<html><small>Use <b>{{SECRET_NAME}}</b> in HTTP files, prompts, and scripts</small></html>"
        ).apply {
            border = BorderFactory.createEmptyBorder(4, 8, 4, 8)
        }

        root.apply {
            border = BorderFactory.createEmptyBorder(8, 8, 8, 8)
            add(topPanel,  BorderLayout.NORTH)
            add(scrollPane, BorderLayout.CENTER)
            add(hintLabel, BorderLayout.SOUTH)
        }
    }

    private fun refresh() {
        statusLabel.text = "● Checking vault..."
        statusLabel.foreground = JBColor.GRAY
        secretListModel.clear()
        refreshBtn.isEnabled = false

        ApplicationManager.getApplication().executeOnPooledThread {
            val settings = EnigmAgentSettings.instance
            val client   = VaultClient(settings.vaultHost, settings.vaultPort)
            val status   = client.getStatus()
            val entries  = if (status.unlocked) {
                try { client.listSecrets() } catch (_: Exception) { emptyList() }
            } else emptyList()

            SwingUtilities.invokeLater {
                refreshBtn.isEnabled = true
                if (status.running && status.unlocked) {
                    statusLabel.text       = "● ${status.message}"
                    statusLabel.foreground = JBColor(0x2E7D32, 0x66BB6A)
                    entries.forEach { secretListModel.addElement(it) }
                    if (entries.isEmpty()) {
                        statusLabel.text = "● Vault unlocked — no secrets yet. Add with: enigmagent add NAME @localhost VALUE"
                    }
                } else if (status.running) {
                    statusLabel.text       = "● Vault LOCKED — restart enigmagent-mcp"
                    statusLabel.foreground = JBColor(0xF57F17, 0xFFCA28)
                } else {
                    statusLabel.text       = "● Vault server NOT running"
                    statusLabel.foreground = JBColor(0xC62828, 0xEF5350)
                }
            }
        }
    }

    private fun copySelected() {
        val entry = secretList.selectedValue ?: return
        val placeholder = "{{${entry.name}}}"
        CopyPasteManager.getInstance().setContents(StringSelection(placeholder))
        notify("Copied $placeholder to clipboard")
    }

    private fun notify(message: String) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup("EnigmAgent")
            .createNotification(message, NotificationType.INFORMATION)
            .notify(project)
    }
}

/**
 * Renders each vault entry as "NAME  @domain" with the domain grayed out.
 */
private class SecretCellRenderer : DefaultListCellRenderer() {
    override fun getListCellRendererComponent(
        list: JList<*>, value: Any?, index: Int,
        isSelected: Boolean, cellHasFocus: Boolean
    ) = super.getListCellRendererComponent(list, value, index, isSelected, cellHasFocus).also {
        if (value is VaultEntry) {
            val domain = if (value.domain != null) "  @${value.domain}" else ""
            text = "<html><b>${value.name}</b><span style='color:gray'>$domain</span></html>"
        }
    }
}
