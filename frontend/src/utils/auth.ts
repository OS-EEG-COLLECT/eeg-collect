// Login data is stored in localStorage by LoginPage.vue

export const MIN_PASSWORD_LENGTH = 8;

export const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("user_token")}`,
});

export const getCurrentUser = () => ({
  id: localStorage.getItem("user_id"),
  username: localStorage.getItem("username") || "",
  isAdmin: localStorage.getItem("is_admin") === "true",
});

export const clearLogin = () => {
  localStorage.removeItem("user_token");
  localStorage.removeItem("user_id");
  localStorage.removeItem("username");
  localStorage.removeItem("is_admin");
};
