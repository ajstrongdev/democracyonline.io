import axios from "axios";

export type UserInfo = {
  id: number;
  email: string;
  username: string;
  bio: string;
  political_leaning: string;
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

export const getUserById = async (userId: number) => {
  try {
    const response = await axios.post(`/api/get-user-by-id`, { userId });
    return response.data.username;
  } catch (error) {
    return "Unknown User";
  }
};

export const getUserFullById = async (
  userId: number
): Promise<UserInfo | null> => {
  try {
    const response = await axios.post(`/api/get-user-by-id`, { userId });
    return response.data;
  } catch (error) {
    console.error("Error fetching user by id:", error);
    return null;
  }
};
