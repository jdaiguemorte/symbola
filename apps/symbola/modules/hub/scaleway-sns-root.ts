// Lot 55 (MSG-05, SEC-19 ; ADR 0102) — certificat racine de Scaleway pour les messages de Topics and
// Events (« Scaleway MnQ Root », valable du 28/06/2022 au 25/06/2032), publié dans
// https://messaging.s3.fr-par.scw.cloud/fr-par/sns/sns-trust-chain.pem. Épinglé ici : la chaîne
// intermédiaire et le certificat de signature, téléchargés, ne sont crus que s'ils en descendent.
// Empreinte SHA-256 vérifiée par le test (scaleway-webhook.test.ts). Un certificat public, pas un secret.
export const SCALEWAY_SNS_ROOT_PEM = `-----BEGIN CERTIFICATE-----
MIIDKTCCAhGgAwIBAgIUY6AfGz9I3izxKghHlHm1nGZjDH4wDQYJKoZIhvcNAQEL
BQAwHDEaMBgGA1UEAxMRU2NhbGV3YXkgTW5RIFJvb3QwHhcNMjIwNjI4MjMxNDU3
WhcNMzIwNjI1MjMxNTI3WjAcMRowGAYDVQQDExFTY2FsZXdheSBNblEgUm9vdDCC
ASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMtSiWNtxnmn6xoQ9AV1EGvW
+AZEqKtbttclL1+FYhSbkpVG+ZqYACnAYnLO4ThXxvd/NGIGJhhGnUACcBieVeDa
mW7W0ihGS2hIhNmgF4Krk33YmH0Fv9g7sOLRQtUOdGDII+sC1gFQ62BkPWJE1sD9
+lH5klYACiIEEdQbXbq1WdxExzdteLLoAdQnHlgq2T5p6ExWHF2l47zoWx57GxGW
tpEUR8fNXjvrCaxT8SRGTHYrhdKuURu0wqeLe4ZKo1ZhkT2DmTUC/V44LKs+qHKP
4kP/TRPWPluSLlNCw2EENaAT7YjIYFXRgvhTUQDdDy8NqMlPlsyR91jWfgLOOSEC
AwEAAaNjMGEwDgYDVR0PAQH/BAQDAgEGMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0O
BBYEFGDBDigVCoj8/iud9o/2ZG5mH+G3MB8GA1UdIwQYMBaAFGDBDigVCoj8/iud
9o/2ZG5mH+G3MA0GCSqGSIb3DQEBCwUAA4IBAQBrTwDD8/DzPNNUAHZwcqi+XrnP
69Zb1QqLPaISVcSse0if/Qw/AhIV0jNEqhgM6eKRMzNLVjN1iBhMOX13RtF51z3O
GfVE9xIT8Rq8gs0fBCagAkFT1bhC0y679M0JQPWUPYYp21Dku95lV3jBAGRyH4ZP
gwvtCAEjdCNPFl9e5r6lYS0bJ/Ls66Cr/V0yk1EHdIxnhaCGD0q9WpfBmPyGwsLm
EfIUixJUQdqNztel4TzUMw+QpkmiQMFfEpLPFWZePMoIIXv7QR1URRkodwipqGa0
Awagvuiapfu5xxuxAful/bC6HFbVjg1su2IsUQKed/Pnvy2fQTNVlKiDQmhp
-----END CERTIFICATE-----`;

export const SCALEWAY_SNS_ROOT_SHA256 = "C5:A0:14:5E:FB:57:91:6C:07:F9:AF:3E:3F:31:12:15:06:2C:05:62:C2:D5:6D:7F:F3:C5:7D:A9:FB:52:E4:D5";
