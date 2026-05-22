import axios from "axios";
import ProviderTokenStore from "../../../../models/providerTokenStore.js";
import { ProviderError } from "../../ProviderError.js";

const BASE_URL = () =>
  String(process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external").replace(/\/+$/, "");

function addHours(d, hours) {
  return new Date(d.getTime() + hours * 60 * 60 * 1000);
}

export class ShiprocketClient {
  constructor() {
    this.providerName = "shiprocket";
  }

  async getToken() {
    const stored = await ProviderTokenStore.findOne({ providerName: this.providerName });
    if (stored && stored.expiresAt && stored.expiresAt > new Date()) return stored.accessToken;
    return this.refreshToken();
  }

  async refreshToken() {
    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;
    if (!email || !password) {
      throw new ProviderError(
        "CONFIG_MISSING",
        "Shiprocket credentials missing (SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD)",
      );
    }

    const url = `${BASE_URL()}/auth/login`;
    const res = await axios.post(url, { email, password }, { timeout: 20000 });
    const token = res?.data?.token;
    if (!token) throw new ProviderError("TOKEN_MISSING", "Shiprocket login did not return token");

    await ProviderTokenStore.findOneAndUpdate(
      { providerName: this.providerName },
      { accessToken: token, expiresAt: addHours(new Date(), 23), updatedAt: new Date() },
      { upsert: true, new: true },
    );

    return token;
  }

  async request(method, path, data) {
    const token = await this.getToken();
    const url = `${BASE_URL()}${path.startsWith("/") ? "" : "/"}${path}`;
    try {
      const res = await axios({
        method,
        url,
        data,
        timeout: 30000,
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        await ProviderTokenStore.deleteOne({ providerName: this.providerName });
        throw new ProviderError("TOKEN_EXPIRED", "Shiprocket token expired", err);
      }
      throw new ProviderError("REQUEST_FAILED", "Shiprocket request failed", err);
    }
  }
}

