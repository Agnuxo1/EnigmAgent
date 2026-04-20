module.exports = {
  run: [
    {
      method: "shell.stop",
      params: {
        path: "app/platforms/cli",
      },
    },
    {
      method: "notify",
      params: {
        html: "EnigmAgent vault stopped.",
      },
    },
  ],
};
