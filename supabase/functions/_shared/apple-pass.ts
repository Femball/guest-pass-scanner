import { PKPass } from "npm:passkit-generator@3.5.7";
import forge from "npm:node-forge@1.3.1";
import { Buffer } from "node:buffer";

export interface CardData {
  card_uid: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  company_logo_url?: string | null;
  valid_until?: string | null;
  member_type?: string | null;
}

const PROJECT_URL = "https://cgowurmyyrkftiqweavn.supabase.co";
export const WEB_SERVICE_URL = `${PROJECT_URL}/functions/v1/apple-wallet-webservice`;

async function fetchImageBuffer(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.error("fetchImageBuffer error:", err);
    return null;
  }
}

export function loadAppleCredentials() {
  const certBase64 = Deno.env.get("APPLE_WALLET_CERTIFICATE_P12");
  const certPassword = Deno.env.get("APPLE_WALLET_CERTIFICATE_PASSWORD") || "";
  const wwdrRaw = Deno.env.get("APPLE_WALLET_WWDR");
  const teamId = Deno.env.get("APPLE_WALLET_TEAM_ID");

  if (!certBase64 || !wwdrRaw || !teamId) {
    throw new Error("Configuration Apple Wallet incomplète");
  }

  const wwdrPem = wwdrRaw.includes("BEGIN CERTIFICATE")
    ? wwdrRaw
    : forge.pki.certificateToPem(
        forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(atob(wwdrRaw)))),
      );

  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(atob(certBase64)));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certPassword);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ??
    [];

  const certificate = certBags[0]?.cert;
  const privateKey = keyBags[0]?.key;
  if (!certificate || !privateKey) {
    throw new Error("Certificat .p12 illisible (mot de passe incorrect ?)");
  }

  const uidField = certificate.subject.getField({ type: "0.9.2342.19200300.100.1.1" });
  const passTypeId = Deno.env.get("APPLE_WALLET_PASS_TYPE_ID") || uidField?.value;
  if (!passTypeId) {
    throw new Error("Pass Type ID introuvable dans le certificat");
  }

  return {
    wwdrPem,
    signerCertPem: forge.pki.certificateToPem(certificate),
    signerKeyPem: forge.pki.privateKeyToPem(privateKey),
    passTypeId,
    teamId,
  };
}

export async function generateApplePass(
  card: CardData,
  authenticationToken?: string | null,
): Promise<Uint8Array> {
  const { wwdrPem, signerCertPem, signerKeyPem, passTypeId, teamId } = loadAppleCredentials();

  const base = `${PROJECT_URL}/storage/v1/object/public/email-assets/wallet`;

  const [iconBuf, icon2xBuf, logoBuf, stripBuf] = await Promise.all([
    fetchImageBuffer(`${base}%2Ficon.png`),
    fetchImageBuffer(`${base}%2Ficon%402x.png`),
    fetchImageBuffer(`${base}%2Flogo.png`),
    fetchImageBuffer(`${base}%2Fstrip.png`),
  ]);

  if (!iconBuf) {
    throw new Error("Icône du pass introuvable");
  }

  const validLabel = card.valid_until
    ? new Date(card.valid_until).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  const passJson: Record<string, unknown> = {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    serialNumber: card.card_uid,
    teamIdentifier: teamId,
    organizationName: "L'Access",
    description: `Carte membre L'Access - ${card.first_name} ${card.last_name}`,
    logoText: "L'Access",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(0, 0, 0)",
    labelColor: "rgb(212, 175, 55)",
    ...(authenticationToken
      ? { webServiceURL: WEB_SERVICE_URL, authenticationToken }
      : {}),
    generic: {
      headerFields: [
        {
          key: "type",
          label: "Adhérent",
          value: card.member_type || "Standard",
          textAlignment: "PKTextAlignmentRight",
        },
      ],
      primaryFields: [
        { key: "name", label: "Membre", value: `${card.first_name} ${card.last_name}` },
      ],
      secondaryFields: [
        { key: "company", label: "Entreprise", value: card.company_name || "L'Access" },
      ],
      auxiliaryFields: [
        {
          key: "valid",
          label: "Valable jusqu'au",
          value: validLabel,
          changeMessage: "Validité mise à jour : %@",
        },
      ],
      backFields: [
        { key: "uid", label: "Numéro de carte", value: card.card_uid },
        {
          key: "terms",
          label: "Conditions",
          value:
            "Carte nominative, non transférable. Présentation obligatoire pour bénéficier des avantages.",
        },
      ],
    },
  };

  const pass = new PKPass(
    {
      "pass.json": Buffer.from(JSON.stringify(passJson)),
      "icon.png": Buffer.from(iconBuf),
      "icon@2x.png": Buffer.from(icon2xBuf ?? iconBuf),
      ...(logoBuf ? { "logo.png": Buffer.from(logoBuf), "logo@2x.png": Buffer.from(logoBuf) } : {}),
      ...(stripBuf
        ? { "thumbnail.png": Buffer.from(stripBuf), "thumbnail@2x.png": Buffer.from(stripBuf) }
        : {}),
    },
    { wwdr: wwdrPem, signerCert: signerCertPem, signerKey: signerKeyPem },
    { passTypeIdentifier: passTypeId, teamIdentifier: teamId },
  );

  return pass.getAsBuffer();
}
