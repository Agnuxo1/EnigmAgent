package com.enigmagent.vault.actions

import com.enigmagent.vault.client.VaultClient
import com.enigmagent.vault.settings.EnigmAgentSettings
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.wm.ToolWindowManager

class ListSecretsAction : AnAction("Browse Secrets") {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        // Open / focus the EnigmAgent tool window
        ApplicationManager.getApplication().invokeLater {
            ToolWindowManager.getInstance(project)
                .getToolWindow("EnigmAgent")
                ?.show(null)
        }
    }
}
