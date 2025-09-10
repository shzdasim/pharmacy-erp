import axios from "axios";

export const listUsers = (params) => axios.get("/api/users", { params });
export const getUser   = (id) => axios.get(`/api/users/${id}`);
export const createUser= (payload) => axios.post("/api/users", payload);
export const updateUser= (id, payload) => axios.put(`/api/users/${id}`, payload);
export const deleteUser= (id) => axios.delete(`/api/users/${id}`);
