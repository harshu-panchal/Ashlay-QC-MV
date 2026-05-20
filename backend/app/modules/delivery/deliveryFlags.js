export function getDeliveryProviderName() {
  return String(process.env.DELIVERY_PROVIDER || "internal").trim().toLowerCase();
}

export function isDeliveryModuleEnabled() {
  const provider = getDeliveryProviderName();
  if (!provider || provider === "none" || provider === "disabled" || provider === "off") {
    return false;
  }
  return true;
}

