module.exports = {
  run: [
    // Clone the repo
    {
      method: "shell.run",
      params: {
        message: "git clone https://github.com/agnuxo1/EnigmAgent app",
        path: ".",
      },
    },
    // Install Node.js CLI dependencies
    {
      method: "shell.run",
      params: {
        message: "npm install",
        path: "app/platforms/cli",
      },
    },
    // Install Python vault dependencies (optional - for Python SDK)
    {
      method: "shell.run",
      params: {
        message: "pip install enigmagent",
        path: "app",
      },
    },
    // Mark install complete
    {
      method: "local.set",
      params: {
        enigmagent_installed: true,
      },
    },
    {
      method: "notify",
      params: {
        html: "<b>EnigmAgent installed!</b> Click Start to launch the vault server.",
      },
    },
  ],
};
