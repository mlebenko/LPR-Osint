export const metadata = { title: "OSINT LPR Wizard", description: "Find decision makers" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body style={{fontFamily:"Inter, system-ui, Arial", background:"#f8fafc", color:"#0f172a"}}>
        <div style={{maxWidth: 920, margin:"0 auto", padding:"32px 20px"}}>{children}</div>
      </body>
    </html>
  );
}
