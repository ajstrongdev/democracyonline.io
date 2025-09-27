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
    const response = await axios.post("/api/get-user-by-email", { email });
    return response.data;
  } catch (error) {
    console.error("Error fetching user info:", error);
  }
};
