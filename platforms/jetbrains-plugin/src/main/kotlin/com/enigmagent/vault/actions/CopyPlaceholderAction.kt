package com.enigmagent.vault.actions

import com.enigmagent.vault.client.VaultClient
import com.enigmagent.vault.settings.EnigmAgentSettings
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.ui.popup.JBPopupFactory
import java.awt.datatransfer.StringSelection

class CopyPlaceholderAction : AnAction("Copy {{Placeholder}} to Clipboard") {

    override fun actionPerformed(e: AnActionEvent) {
        val project  = e.project ?: return
        val settings = EnigmAgentSettings.instance

        ApplicationManager.getApplication().executeOnPooledThread {
            val client  = VaultClient(settings.vaultHost, settings.vaultPort)
            val entries = try {
                client.listSecrets()
            } catch (ex: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    NotificationGroupManager.getInstance()
                        .getNotificationGroup("EnigmAgent")
                        .createNotification(
                            "Cannot connect to vault: ${ex.message}",
                            NotificationType.ERROR
                        ).notify(project)
                }
                return@executeOnPooledThread
            }

            if (entries.isEmpty()) {
                ApplicationManager.getApplication().invokeLater {
                    NotificationGroupManager.getInstance()
                        .getNotificationGroup("EnigmAgent")
                        .createNotification("Vault is empty — add secrets first.", NotificationType.WARNING)
                        .notify(project)
                }
                return@executeOnPooledThread
            }

            ApplicationManager.getApplication().invokeLater {
                val items = entries.map { "{{${it.name}}}" }.toTypedArray()
                JBPopupFactory.getInstance()
                    .createPopupChooserBuilder(items.toList())
                    .setTitle("Copy EnigmAgent Placeholder")
                    .setItemChosenCallback { chosen ->
                        CopyPasteManager.getInstance().setContents(StringSelection(chosen))
                        NotificationGroupManager.getInstance()
                            .getNotificationGroup("EnigmAgent")
                            .createNotification("Copied $chosen to clipboard", NotificationType.INFORMATION)
                            .notify(project)
                    }
                    .createPopup()
                    .showInFocusCenter()
            }
        }
    }
}
