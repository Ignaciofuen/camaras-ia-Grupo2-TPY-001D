import api from './api';

const USERS_ENDPOINT = import.meta.env.VITE_USERS_ENDPOINT || '/usuarios';

const normalizeApiUsers = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.usuarios)) return data.usuarios;
  if (Array.isArray(data?.users)) return data.users;
  return [];
};

const normalizeApiUser = (data) => data?.usuario || data?.user || data;

const normalizeUserPayload = (userData) => {
  const payload = { ...userData };

  if (!payload.temporaryPassword) {
    delete payload.temporaryPassword;
  }

  return payload;
};

export const getUsers = async (signal) => {
  const response = await api.get(USERS_ENDPOINT, { signal });
  return normalizeApiUsers(response.data);
};

export const createUser = async (userData) => {
  const response = await api.post(USERS_ENDPOINT, normalizeUserPayload(userData));
  return normalizeApiUser(response.data);
};

export const updateUser = async (userId, userData) => {
  const response = await api.put(
    `${USERS_ENDPOINT}/${encodeURIComponent(userId)}`,
    normalizeUserPayload(userData)
  );
  return normalizeApiUser(response.data);
};

export const deleteUser = async (userId) => {
  const response = await api.delete(`${USERS_ENDPOINT}/${encodeURIComponent(userId)}`);
  return response.data;
};

export const userService = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
};

export default userService;
