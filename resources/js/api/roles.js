// src/api/roles.js
import axios from "axios";

export const listRoles = (params = {}) =>
  axios.get("/api/roles", { params }); // {search, page, per_page}

export const getRole = (id) =>
  axios.get(`/api/roles/${id}`);

export const createRole = (payload) =>
  axios.post("/api/roles", payload); // { name, permissions:[] }

export const updateRole = (id, payload) =>
  axios.put(`/api/roles/${id}`, payload);

export const deleteRole = (id) =>
  axios.delete(`/api/roles/${id}`);

export const listAllPermissions = (params = {}) =>
  axios.get("/api/permissions", { params }); // returns [ "user.view", ... ]
