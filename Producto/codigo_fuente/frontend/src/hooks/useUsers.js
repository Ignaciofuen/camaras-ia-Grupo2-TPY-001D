import { useCallback, useEffect, useMemo, useState } from 'react';
import userService from '../services/userService';

const isCanceled = (error) => (
  error?.name === 'CanceledError' || error?.name === 'AbortError'
);

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadUsers = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError(null);
      const data = await userService.getUsers(signal);
      setUsers(Array.isArray(data) ? data : []);
    } catch (loadError) {
      if (isCanceled(loadError)) return;
      setError(loadError.message || 'No se pudo cargar usuarios');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => loadUsers(controller.signal));
    return () => controller.abort();
  }, [loadUsers]);

  const refresh = useCallback(() => {
    const controller = new AbortController();
    return loadUsers(controller.signal);
  }, [loadUsers]);

  const createUser = useCallback(async (payload) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const created = await userService.createUser(payload);
      setUsers((current) => [created, ...current]);
      setSuccess('Usuario creado correctamente');
      return created;
    } catch (createError) {
      setError(createError.message || 'No se pudo crear el usuario');
      throw createError;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateUser = useCallback(async (userId, payload) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const updated = await userService.updateUser(userId, payload);
      setUsers((current) => current.map((user) => (
        user.id === userId || user.uuid === userId ? { ...user, ...updated } : user
      )));
      setSuccess('Usuario actualizado correctamente');
      return updated;
    } catch (updateError) {
      setError(updateError.message || 'No se pudo actualizar el usuario');
      throw updateError;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteUser = useCallback(async (userId) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await userService.deleteUser(userId);
      setUsers((current) => current.filter((user) => (
        user.id !== userId && user.uuid !== userId
      )));
      setSuccess('Usuario eliminado correctamente');
    } catch (deleteError) {
      setError(deleteError.message || 'No se pudo eliminar el usuario');
      throw deleteError;
    } finally {
      setSaving(false);
    }
  }, []);

  const stats = useMemo(() => {
    const active = users.filter((user) => (
      user.status === 'active' || user.estado === 'activo'
    )).length;
    const admins = users.filter((user) => {
      const role = user.role || user.rol || '';
      return role === 'administrator' || role === 'admin';
    }).length;

    return {
      total: users.length,
      active,
      inactive: users.length - active,
      admins,
    };
  }, [users]);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  return {
    users,
    stats,
    loading,
    saving,
    error,
    success,
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    refresh,
    clearMessages,
  };
};

export default useUsers;
