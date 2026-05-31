import { DATA_DIR } from "../config.js";
import * as path from "node:path";
import { readJson, writeJson } from "./files.js";

const PRICING_FILE = path.join(DATA_DIR, "pricing_config.json");

export interface RolePlanPrices {
  bronze:   string;
  silver:   string;
  gold:     string;
  premium:  string;
  diamond:  string;
  emerald:  string;
  obsidian: string;
}

export interface PrivateBotPricing {
  price:    string;
  monthly:  string;
  features: string;
  contact:  string;
}

export interface PricingConfig {
  rolePlans?:  RolePlanPrices;
  privateBot?: PrivateBotPricing;
}

export function readPricingConfig(): PricingConfig {
  return readJson<PricingConfig>(PRICING_FILE, {});
}

export function saveRolePlanPrices(prices: RolePlanPrices): void {
  const cfg = readPricingConfig();
  cfg.rolePlans = prices;
  writeJson(PRICING_FILE, cfg);
}

export function savePrivateBotPricing(pricing: PrivateBotPricing): void {
  const cfg = readPricingConfig();
  cfg.privateBot = pricing;
  writeJson(PRICING_FILE, cfg);
}
