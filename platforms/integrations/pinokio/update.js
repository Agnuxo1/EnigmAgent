module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "git pull",
        path: "app",
      },
    },
    {
      method: "shell.run",
      params: {
        message: "npm install",
        path: "app/platforms/cli",
      },
    },
    {
      method: "notify",
      params: {
        html: "<b>EnigmAgent updated!</b>",
      },
    },
  ],
};
