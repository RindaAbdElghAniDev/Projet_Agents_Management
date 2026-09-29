import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineMail } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import { loginSchema } from '../lib/validators';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = location.state?.message;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data) => {
    try {
      await login(data.email.trim(), data.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold text-primary-600">Agent Management System</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">Connexion</h1>
        </div>

        {successMessage && (
          <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Input
            id="email"
            label="Email"
            type="email"
            icon={HiOutlineMail}
            placeholder="exemple@email.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <div>
            <Input
              id="password"
              label="Mot de passe"
              type="password"
              placeholder="Votre mot de passe"
              error={errors.password?.message}
              {...register('password')}
            />
            <div className="mt-1.5 text-right">
              <Link to="/forgot-password" className="text-xs font-medium text-primary-600 hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>
          </div>
          <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
            Se connecter
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Pas encore de compte ?{' '}
          <Link to="/register" className="font-semibold text-primary-600 hover:underline">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;