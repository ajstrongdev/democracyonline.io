const authPages = new Set(["/login", "/register"]);
const protectedRoutePrefixes = [
    "/dashboard",
    "/settings",
    "/social",
    "/admin",
    "/search",
];

export function isProtectedRoute(pathname: string) {
    return protectedRoutePrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}

export function getAuthRedirect(
    pathname: string,
    isAuthenticated: boolean,
    isLoading = false,
    hasSessionCookie = false,
) {
    const isSignedIn = isAuthenticated || hasSessionCookie;

    if (isLoading) {
        return null;
    }

    if (isSignedIn && authPages.has(pathname)) {
        return "/dashboard";
    }

    if (!isSignedIn && isProtectedRoute(pathname)) {
        return "/login";
    }

    return null;
}
