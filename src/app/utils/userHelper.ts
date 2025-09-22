import axios from "axios";

export type UserInfo = {
  id: number;
  email: string;
  username: string;
  role: string;
  party_id: number | null;
  created_at: string;
};

export const fetchUserInfo = async (email: string) => {
  if (!email) return;

  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/users/${email}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching user info:", error);
  }
};
