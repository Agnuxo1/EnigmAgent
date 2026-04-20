module.exports = {
  title: "EnigmAgent",
  description: "Encrypted local vault for AI agents — {{PLACEHOLDER}} secret injection.",
  icon: "icon.png",

  menu: async (kernel) => {
    const installed = await kernel.exists("app");
    if (!installed) {
      return [{ text: "Install", href: "install.js" }];
    }
    const running = await kernel.running("start.js");
    if (running) {
      return [
        { text: "Open Vault", href: "https://enigmagent.pages.dev", target: "_blank" },
        { text: "Stop",    href: "stop.js" },
        { text: "Logs",    href: "start.js", params: { logs: true } },
      ];
    }
    return [
      { text: "Start",    href: "start.js" },
      { text: "Update",   href: "update.js" },
    ];
  },
};
