export const metadata = { title: "OSINT ЛПР/ЛВПР", description: "3-этапный мастер по поиску ЛПР" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body style={{fontFamily:"Inter, system-ui, Arial", background:"#f8fafc", color:"#0f172a"}}>
        <div style={{maxWidth: 1000, margin:"0 auto", padding:"32px 20px"}}>{children}</div>
      </body>
    </html>
  );
}
