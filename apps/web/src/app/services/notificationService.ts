
const API_URL = 'http://localhost:3000'; // Assuming the API is running on this port

export const getNotifications = async () => {
  try {
    const response = await fetch(`${API_URL}/notifications`);
    if (!response.ok) {
      throw new Error('Failed to fetch notifications');
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
};
