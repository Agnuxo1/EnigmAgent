package com.enigmagent.vault.settings

import com.intellij.openapi.options.Configurable
import com.intellij.openapi.ui.DialogPanel
import com.intellij.ui.dsl.builder.*
import javax.swing.JComponent

class EnigmAgentSettingsConfigurable : Configurable {

    private var panel: DialogPanel? = null

    override fun getDisplayName() = "EnigmAgent Vault"

    override fun createComponent(): JComponent {
        val settings = EnigmAgentSettings.instance
        val p = panel {
            group("Vault Server") {
                row("Host:") {
                    textField()
                        .bindText(settings::vaultHost)
                        .comment("Default: 127.0.0.1 — vault binds to localhost only")
                        .columns(COLUMNS_MEDIUM)
                }
                row("Port:") {
                    intTextField(1..65535)
                        .bindIntText(settings::vaultPort)
                        .comment("Default: 3737")
                        .columns(COLUMNS_SHORT)
                }
                row("Origin:") {
                    textField()
                        .bindText(settings::origin)
                        .comment("Sent with resolve requests for domain binding")
                        .columns(COLUMNS_MEDIUM)
                }
            }
            group("Behaviour") {
                row {
                    checkBox("Auto-refresh vault status on panel open")
                        .bindSelected(settings::autoRefresh)
                }
            }
            row {
                comment("""
                    Start the vault server with:<br>
                    <code>enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json</code>
                """.trimIndent())
            }
        }
        panel = p
        return p
    }

    override fun isModified(): Boolean = panel?.isModified() ?: false

    override fun apply() {
        panel?.apply()
    }

    override fun reset() {
        panel?.reset()
    }
}
