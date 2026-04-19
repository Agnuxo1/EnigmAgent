package com.enigmagent.vault.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.xmlb.XmlSerializerUtil

@State(
    name   = "EnigmAgentSettings",
    storages = [Storage("EnigmAgentSettings.xml")]
)
class EnigmAgentSettings : PersistentStateComponent<EnigmAgentSettings> {

    var vaultHost:   String = "127.0.0.1"
    var vaultPort:   Int    = 3737
    var origin:      String = "http://localhost"
    var autoRefresh: Boolean = true

    override fun getState(): EnigmAgentSettings = this

    override fun loadState(state: EnigmAgentSettings) {
        XmlSerializerUtil.copyBean(state, this)
    }

    companion object {
        val instance: EnigmAgentSettings
            get() = ApplicationManager.getApplication()
                .getService(EnigmAgentSettings::class.java)
    }
}
