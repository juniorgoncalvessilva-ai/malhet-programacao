export const UI_ELEMENTS = ["Alerts", "Buttons", "Badges", "Spinners", "Toasts", "Dialogs", "Drawers", "Carousels"]
  .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  .map((value) => ({
    title: value,
    url: "/ui-elements/" + value.split(" ").join("-").toLowerCase(),
    isPro: !["Alerts", "Buttons", "Badges", "Spinners", "Toasts", "Dialogs", "Drawers", "Carousels"].includes(value),
  }));
