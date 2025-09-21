import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { useRouter } from "next/navigation";
import axios from "axios";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function directToProfile(email: string, router: ReturnType<typeof useRouter>) {
    const usernameResponse = await axios.post<{ username?: string }>(`${process.env.NEXT_PUBLIC_API_URL}/get-username`, {
        email: email
    })

    if (usernameResponse.data.username && usernameResponse.data.username !== "") {
        router.push(`/profile/${usernameResponse.data.username}`);
    }
    else {
        console.log("Couldn't redirect to profile, no username found");
    }
}