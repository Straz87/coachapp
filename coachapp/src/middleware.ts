import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Protegge le rotte: se non sei loggato vieni rimandato a /login.
// Le rotte pubbliche (login, invito) restano accessibili. Le API route
// gestiscono la propria autenticazione internamente (sessione cookie per
// le chiamate dal browser, CRON_SECRET per i job schedulati come
// /api/cron/*, che non hanno alcuna sessione utente).
const PUBLIC_PATHS = ["/login", "/invito", "/auth", "/api", "/iscriviti", "/s"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response = NextResponse.next({ request });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // manifest.json e sw.js sono letti dal sistema operativo del telefono ad
  // ogni apertura dell'app installata sulla home: non devono passare da
  // Supabase per un controllo di autenticazione che non serve a nulla (sono
  // file pubblici) e che aggiungeva un giro di rete inutile proprio nel
  // momento piu delicato, l'avvio dell'app.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
