package enigmagent.plugin;

import org.eclipse.core.runtime.preferences.AbstractPreferenceInitializer;
import org.eclipse.jface.preference.IPreferenceStore;

/**
 * Sets default values for EnigmAgent preferences.
 */
public class PreferenceInitializer extends AbstractPreferenceInitializer {

    @Override
    public void initializeDefaultPreferences() {
        IPreferenceStore store = Activator.getDefault().getPreferenceStore();
        store.setDefault("vaultHost",   "127.0.0.1");
        store.setDefault("vaultPort",   3737);
        store.setDefault("vaultOrigin", "http://localhost");
    }
}
