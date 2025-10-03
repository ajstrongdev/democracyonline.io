"use client";
import { auth } from "@/lib/firebase";
import { useSignOut, useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import withAuth from "@/lib/withAuth";

function Home() {
  const [user, loading] = useAuthState(auth);
  const [signOut] = useSignOut(auth);
  const router = useRouter();

  const handleSignOut = async () => {
    const success = await signOut();
    if (success) {
      router.push("/");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Online Democratic Republic</CardTitle>
          <CardDescription>You are successfully signed in!</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Signed in as: <span className="font-medium">{user.email}</span>
            </p>
            <Button onClick={handleSignOut} variant="outline">
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(Home);
