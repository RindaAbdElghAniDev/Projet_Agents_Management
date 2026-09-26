import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { HiOutlineUser, HiOutlineMail, HiOutlineLockClosed } from 'react-icons/hi';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { profileSchema, passwordSchema } from '../lib/validators';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

const Profile = () => {
  const { user, setUser } = useAuth();

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', email: user?.email || '' },
  });

  const passwordForm = useForm({ resolver: zodResolver(passwordSchema) });

  const onSubmitProfile = async (data) => {
    try {
      const res = await api.put('/auth/profile', data);
      setUser(res.data.user);
      toast.success('Profil mis à jour avec succès');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onSubmitPassword = async (data) => {
    try {
      await api.put('/auth/password', data);
      toast.success('Mot de passe modifié avec succès');
      passwordForm.reset();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const initials = user?.name
    ?.split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Mon profil</h1>

      <Card>
        <div className="mb-6 flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-lg font-semibold text-white">
            {initials}
          </span>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{user?.name}</p>
            <Badge color={user?.role === 'ADMIN' ? 'purple' : 'blue'}>{user?.role}</Badge>
          </div>
        </div>

        <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="flex flex-col gap-4" noValidate>
          <Input
            label="Nom"
            icon={HiOutlineUser}
            error={profileForm.formState.errors.name?.message}
            {...profileForm.register('name')}
          />
          <Input
            label="Email"
            type="email"
            icon={HiOutlineMail}
            error={profileForm.formState.errors.email?.message}
            {...profileForm.register('email')}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={profileForm.formState.isSubmitting}>
              Enregistrer les modifications
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Changer le mot de passe">
        <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="flex flex-col gap-4" noValidate>
          <Input
            label="Mot de passe actuel"
            type="password"
            icon={HiOutlineLockClosed}
            error={passwordForm.formState.errors.currentPassword?.message}
            {...passwordForm.register('currentPassword')}
          />
          <Input
            label="Nouveau mot de passe"
            type="password"
            icon={HiOutlineLockClosed}
            error={passwordForm.formState.errors.newPassword?.message}
            {...passwordForm.register('newPassword')}
          />
          <Input
            label="Confirmer le nouveau mot de passe"
            type="password"
            icon={HiOutlineLockClosed}
            error={passwordForm.formState.errors.confirmPassword?.message}
            {...passwordForm.register('confirmPassword')}
          />
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" loading={passwordForm.formState.isSubmitting}>
              Changer le mot de passe
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default Profile;