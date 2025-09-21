import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { useRouter } from "next/navigation";
import axios from "axios";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function directToProfile(email: string, router: ReturnType<typeof useRouter>) {
    const id = await axios.post<{ id?: string }>(`${process.env.NEXT_PUBLIC_API_URL}/get-username`, {
        email
    })

    if (id.data.id && id.data.id !== "") {
        router.push(`/profile/${id.data.id}`);
    }
    else {
        console.log("Couldn't redirect to profile, no username found");
    }
}