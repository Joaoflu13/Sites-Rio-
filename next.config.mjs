/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // bibliotecas de e-mail do assistente (SMTP/IMAP): rodam como módulos Node, sem bundle
  serverExternalPackages: ["nodemailer", "imapflow", "mailparser"],
};

export default nextConfig;
