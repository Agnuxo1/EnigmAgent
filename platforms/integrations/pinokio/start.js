module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "node bin/enigmagent.js serve --port 39517",
        path: "app/platforms/cli",
        env: {
          NODE_ENV: "production",
        },
        // Keep process alive
        background: true,
      },
    },
    {
      method: "notify",
      params: {
        html: "<b>EnigmAgent vault running</b> on <code>http://127.0.0.1:39517</code>",
      },
    },
  ],
};
