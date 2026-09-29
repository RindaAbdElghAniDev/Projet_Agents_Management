import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HiOutlineLockClosed, HiOutlineMail, HiOutlineKey } from 'react-icons/hi';
import api from '../services/api';
import { resetPasswordSchema } from '../lib/validators';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  // Email pré-rempli s'il vient de ForgotPassword, sinon l'utilisateur le tape lui-même
  const emailFromState = location.state?.email || '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: emailFromState },
  });

  const onSubmit = async (data) => {
    setServerError('');
    try {
      await api.post('/auth/reset-password', {
        email: data.email.trim().toLowerCase(),
        code: data.code.trim(),
        newPassword: data.newPassword,
      });
      navigate('/login', {
        state: { message: 'Mot de passe réinitialisé avec succès. Vous pouvez vous connecter.' },
      });
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold text-primary-600">Agent Management System</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">Réinitialiser le mot de passe</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Entrez le code reçu par email et votre nouveau mot de passe.
          </p>
        </div>

        {serverError && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Input
            id="email"
            label="Email"
            type="email"
            icon={HiOutlineMail}
            placeholder="exemple@gmail.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            id="code"
            label="Code de vérification"
            type="text"
            icon={HiOutlineKey}
            placeholder="6 chiffres"
            maxLength={6}
            error={errors.code?.message}
            {...register('code')}
          />
          <Input
            id="newPassword"
            label="Nouveau mot de passe"
            type="password"
            icon={HiOutlineLockClosed}
            placeholder="6 caractères minimum"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <Input
            id="confirmPassword"
            label="Confirmer le mot de passe"
            type="password"
            icon={HiOutlineLockClosed}
            placeholder="Répétez le mot de passe"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
            Réinitialiser le mot de passe
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <Link to="/login" className="font-semibold text-primary-600 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;