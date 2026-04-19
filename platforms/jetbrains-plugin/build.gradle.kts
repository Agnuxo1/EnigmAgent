import org.jetbrains.intellij.platform.gradle.TestFrameworkType

plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.25"
    id("org.jetbrains.intellij.platform") version "2.1.0"
}

group   = "com.enigmagent"
version = "1.0.0"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        intellijIdeaCommunity("2024.1")
        bundledPlugin("com.intellij.java")
        testFramework(TestFrameworkType.Platform)
    }
    implementation("com.google.code.gson:gson:2.10.1")
    testImplementation("junit:junit:4.13.2")
}

intellijPlatform {
    pluginConfiguration {
        id          = "com.enigmagent.vault"
        name        = "EnigmAgent Vault"
        version     = "1.0.0"
        description = """
            Secure local vault for AI agent credentials.
            Store API keys, tokens, and passwords encrypted. Reference them as {{PLACEHOLDER}}
            in HTTP client files, run configurations, and terminal commands.
            Integrates with LangChain, CrewAI, n8n, AutoGen, and 40+ AI frameworks.
        """.trimIndent()
        changeNotes  = "<ul><li>1.0.0: Initial release</li></ul>"

        ideaVersion {
            sinceBuild = "241"
            untilBuild = "999.*"
        }

        vendor {
            name  = "EnigmAgent"
            email = "dev@enigmagent.com"
            url   = "https://enigmagent.com"
        }
    }

    signing {
        certificateChain = providers.environmentVariable("CERTIFICATE_CHAIN")
        privateKey        = providers.environmentVariable("PRIVATE_KEY")
        password          = providers.environmentVariable("PRIVATE_KEY_PASSWORD")
    }

    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }
}

kotlin {
    jvmToolchain(17)
}
