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
  last_activity: number;
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

export const getUserById = async (userId: number, omitSensitive = false) => {
  try {
    let response;
    if (omitSensitive) {
      response = await axios.post(`/api/get-user-without-email`, { userId });
    } else {
      response = await axios.post(`/api/get-user-by-id`, { userId });
    }
    return response.data.username;
  } catch (error: unknown) {
    console.error("Error fetching user by id:", error);
    return "Unknown User";
  }
};

export const getUserFullById = async (
  userId: number,
  omitSensitive = false
): Promise<UserInfo | null> => {
  try {
    let response;
    if (omitSensitive) {
      response = await axios.post(`/api/get-user-without-email`, { userId });
    } else {
      response = await axios.post(`/api/get-user-by-id`, { userId });
    }

    return response.data;
  } catch (error) {
    console.error("Error fetching user by id:", error);
    // If it's a 403, the user is disabled
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      throw new Error("User is disabled");
    }
    return null;
  }
};
