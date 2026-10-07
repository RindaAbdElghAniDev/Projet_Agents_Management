import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiOutlineUser,
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineHome,
  HiOutlineCake,
  HiOutlineCalendar,
  HiOutlineBriefcase,
  HiOutlineOfficeBuilding,
} from 'react-icons/hi';
import api from '../services/api';
import { myAgentProfileSchema } from '../lib/validators';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

// Parcours de complétion : un compte sans fiche agent crée lui-même sa fiche.
// Le backend reste la source de vérité : on n'envoie QUE les 9 champs qu'il accepte.
// user_id, salary, status et annual_leave_balance sont imposés par le serveur
// et ne doivent JAMAIS figurer dans le body.
const CompleteAgentProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(myAgentProfileSchema),
    defaultValues: {
      first_name: user?.name || '',
      last_name: '',
      email: user?.email || '',
      phone: '',
      address: '',
      birth_date: '',
      hire_date: '',
      department_id: '',
      position: '',
    },
  });

  // Les départements viennent de l'API : aucune liste en dur dans le frontend.
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/departments');
        setDepartments(res.data.departments || []);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setDepartmentsLoading(false);
      }
    };
    fetchDepartments();
  }, []);

  const onSubmit = async (data) => {
    setServerError('');
    try {
      // Corps construit champ par champ : les 4 champs serveur ne sont pas la source.
      await api.post('/agents/me', {
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        birth_date: data.birth_date || null,
        hire_date: data.hire_date,
        department_id: Number(data.department_id),
        position: data.position.trim(),
      });
      toast.success('Fiche agent créée avec succès');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const backendMessage = err.response?.data?.message || err.message;

      // Le backend renvoie deux 409 distincts : ne pas les confondre.
      if (status === 409) {
        // Cas 1 : ce compte possède déjà une fiche -> on va vers le dashboard.
        if (backendMessage?.includes('déjà liée')) {
          toast.info('Vous avez déjà une fiche agent.');
          navigate('/dashboard', { replace: true });
          return;
        }
        // Cas 2 : email déjà pris par un AUTRE agent -> on reste ici.
        // Rediriger menait a /dashboard -> 403 -> formulaire : une boucle
        // qui ferait perdre toute la saisie.
        setServerError(backendMessage);
        toast.error(backendMessage);
        return;
      }

      setServerError(backendMessage);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const disabled = departmentsLoading || departments.length === 0;

  // Champs herites du compte connecte : en lecture seule tant que la donnee
  // source existe. Si elle est absente, le champ reste editable, sinon
  // l'utilisateur serait bloque par un champ vide non modifiable.
  const lockedClass = 'bg-gray-100 dark:bg-gray-700/60 cursor-not-allowed';
  const firstNameLocked = Boolean(user?.name);
  const emailLocked = Boolean(user?.email);

  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h1 className='text-xl font-bold text-gray-900 dark:text-gray-100'>Compléter mon profil</h1>
        <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
          Votre compte n'est pas encore associé à une fiche agent. Renseignez les informations
          ci-dessous pour accéder à vos présences et à vos congés.
        </p>
      </div>

      <Card title='Informations de la fiche agent'>
        {serverError && (
          <div className='mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400'>
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4' noValidate>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Input
              label='Prénom'
              icon={HiOutlineUser}
              readOnly={firstNameLocked}
              className={firstNameLocked ? lockedClass : ''}
              error={errors.first_name?.message}
              {...register('first_name')}
            />
            <Input
              label='Nom'
              icon={HiOutlineUser}
              error={errors.last_name?.message}
              {...register('last_name')}
            />
          </div>

          <Input
            label='Email'
            type='email'
            icon={HiOutlineMail}
            readOnly={emailLocked}
            className={emailLocked ? lockedClass : ''}
            error={errors.email?.message}
            {...register('email')}
          />

          {(firstNameLocked || emailLocked) && (
            <p className='text-xs text-gray-500 dark:text-gray-400'>
              Les champs repris de votre compte (grisés ci-dessus) ne sont pas modifiables.
              Seul le nom de famille reste à saisir.
            </p>
          )}

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Input
              label='Téléphone'
              type='tel'
              icon={HiOutlinePhone}
              placeholder='Optionnel'
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              label='Adresse'
              icon={HiOutlineHome}
              placeholder='Optionnel'
              error={errors.address?.message}
              {...register('address')}
            />
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Input
              label='Date de naissance'
              type='date'
              icon={HiOutlineCake}
              max={today}
              error={errors.birth_date?.message}
              {...register('birth_date')}
            />
            <Input
              label="Date d'embauche"
              type='date'
              icon={HiOutlineCalendar}
              error={errors.hire_date?.message}
              {...register('hire_date')}
            />
          </div>

          <Select
            label='Département'
            error={errors.department_id?.message}
            {...register('department_id')}
          >
            <option value=''>
              {departmentsLoading ? 'Chargement…' : 'Sélectionnez un département'}
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>

          <Input
            label='Poste'
            icon={HiOutlineBriefcase}
            placeholder='Ex. Technicien, Commercial…'
            error={errors.position?.message}
            {...register('position')}
          />

          {departments.length === 0 && !departmentsLoading && (
            <p className='text-sm text-amber-600 dark:text-amber-400'>
              Aucun département disponible. Contactez un administrateur.
            </p>
          )}

          <div className='flex justify-end'>
            <Button type='submit' loading={isSubmitting} disabled={disabled} icon={HiOutlineOfficeBuilding}>
              Créer ma fiche agent
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CompleteAgentProfile;
