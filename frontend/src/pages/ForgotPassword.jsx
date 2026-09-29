import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { HiOutlineMail } from 'react-icons/hi';
import toast from 'react-hot-toast';
import api from '../services/api';
import { forgotPasswordSchema } from '../lib/validators';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (data) => {
    setServerError('');
    try {
      const email = data.email.trim().toLowerCase();
      const res = await api.post('/auth/forgot-password', { email });
      toast.success(res.data.message || 'Si cet email existe, un code a été envoyé.');
      navigate('/reset-password', { state: { email } });
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold text-primary-600">Agent Management System</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">Mot de passe oublié ?</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Entrez votre adresse email pour recevoir un code de vérification.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {serverError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {serverError}
            </div>
          )}
          <Input
            id="email"
            label="Email"
            type="email"
            icon={HiOutlineMail}
            placeholder="exemple@gmail.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
            Envoyer le code
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

export default ForgotPassword;