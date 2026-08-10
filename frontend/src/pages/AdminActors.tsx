import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { Plus } from 'lucide-react';

import ActorsTable from '../components/admin/ActorsTable';
import ActorModal from '../components/admin/ActorModal';
import DeleteConfirmModal from '../components/admin/DeleteConfirmModal';

const DEFAULT_ACTOR_FORM = {
    name: '',
    real_name: '',
    gender: 'Female',
    image_url: '',
    bio: '',
    birth_date: '',
    social_media: '',
};

export default function AdminActors() {
    const { addToast } = useToast();

    const [actorList, setActorList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState(DEFAULT_ACTOR_FORM);
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    // Pagination for actors
    const [currentPage] = useState(1);
    const ITEMS_PER_PAGE = 100; // Load all actors

    const fetchActors = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/actors/');
            setActorList(Array.isArray(res.data) ? res.data : []);
        } catch {
            addToast('Erro ao carregar atores.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => { fetchActors(); }, [fetchActors]);

    const handleOpenNew = () => {
        setEditingId(null);
        setFormData(DEFAULT_ACTOR_FORM);
        setIsModalOpen(true);
    };

    const handleEdit = (actor: any) => {
        setEditingId(actor.id);
        setFormData({
            name: actor.name || '',
            real_name: actor.real_name || '',
            gender: actor.gender || 'Female',
            image_url: actor.image_url || '',
            bio: actor.bio || '',
            birth_date: actor.birth_date || '',
            social_media: actor.social_media || '',
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingId) {
                await api.put(`/actors/${editingId}`, formData);
                addToast('Ator atualizado!', 'success');
            } else {
                await api.post('/actors/', formData);
                addToast('Ator criado!', 'success');
            }
            setIsModalOpen(false);
            fetchActors();
        } catch {
            addToast('Erro ao salvar ator.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await api.delete(`/actors/${deleteTarget.id}`);
            addToast('Ator excluído!', 'success');
            fetchActors();
        } catch {
            addToast('Erro ao excluir ator.', 'error');
        }
    };

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Cinzel, serif' }}>
                        Atores & Atrizes
                    </h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        {actorList.length > 0
                            ? `${actorList.length} ator${actorList.length !== 1 ? 'es' : ''} cadastrado${actorList.length !== 1 ? 's' : ''}`
                            : 'Gerencie o elenco da plataforma'}
                    </p>
                </div>
                <button
                    onClick={handleOpenNew}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-all shadow-lg shadow-purple-600/20"
                >
                    <Plus className="w-4 h-4" />
                    Novo Ator
                </button>
            </div>

            {/* Table / Grid */}
            <ActorsTable
                actorList={actorList}
                loading={loading}
                currentPage={currentPage}
                itemsPerPage={ITEMS_PER_PAGE}
                handleEditActor={handleEdit}
                handleDeleteActor={(id) => {
                    const a = actorList.find((a) => a.id === id);
                    setDeleteTarget({ id, name: a?.name || `Ator #${id}` });
                }}
            />

            {/* Modals */}
            <ActorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSave}
                actorFormData={formData}
                setActorFormData={setFormData}
                editingId={editingId}
                saving={saving}
            />

            <DeleteConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                itemName={deleteTarget?.name}
                message="Esta ação removerá permanentemente o ator da plataforma."
            />
        </div>
    );
}
