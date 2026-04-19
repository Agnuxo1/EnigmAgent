package com.enigmagent.vault.actions

import com.enigmagent.vault.client.VaultClient
import com.enigmagent.vault.settings.EnigmAgentSettings
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager

class VaultStatusAction : AnAction("Check Vault Status") {

    override fun actionPerformed(e: AnActionEvent) {
        val project  = e.project ?: return
        val settings = EnigmAgentSettings.instance

        ApplicationManager.getApplication().executeOnPooledThread {
            val client = VaultClient(settings.vaultHost, settings.vaultPort)
            val status = client.getStatus()

            val (message, type) = when {
                status.unlocked -> Pair(
                    "EnigmAgent vault is RUNNING and UNLOCKED. {{PLACEHOLDER}} references will resolve.",
                    NotificationType.INFORMATION
                )
                status.running  -> Pair(
                    "Vault LOCKED — restart enigmagent-mcp to unlock.",
                    NotificationType.WARNING
                )
                else            -> Pair(
                    "Vault server NOT running — start: enigmagent-mcp --mode rest --port ${settings.vaultPort}",
                    NotificationType.ERROR
                )
            }

            com.intellij.openapi.application.ApplicationManager.getApplication().invokeLater {
                NotificationGroupManager.getInstance()
                    .getNotificationGroup("EnigmAgent")
                    .createNotification(message, type)
                    .notify(project)
            }
        }
    }
}
