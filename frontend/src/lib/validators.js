import { z } from 'zod';
import { getToday } from './date';

// SEC-19 : miroir de cleanAgentData (backend) — règles partagées de dates agent.
// hire_date ne peut pas être future, ni antérieure à birth_date quand celle-ci existe.
const hireDateCheck = (data, ctx) => {
  if (data.hire_date > getToday()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['hire_date'],
      message: "La date d'embauche ne peut pas être dans le futur",
    });
  }
  if (data.birth_date && data.hire_date < data.birth_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['hire_date'],
      message: "La date d'embauche ne peut pas être antérieure à la date de naissance",
    });
  }
};

export const loginSchema = z.object({
  email: z.string().trim().min(1, "L'email est obligatoire").email("Format d'email invalide"),
  password: z.string().min(1, 'Le mot de passe est obligatoire'),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Le nom est obligatoire').max(100, '100 caractères maximum'),
    email: z.string().trim().min(1, "L'email est obligatoire").email("Format d'email invalide"),
    password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
    confirmPassword: z.string().min(1, 'Veuillez confirmer le mot de passe'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export const agentSchema = z.object({
  first_name: z.string().trim().min(1, 'Le prénom est obligatoire').max(100, '100 caractères maximum'),
  last_name: z.string().trim().min(1, 'Le nom est obligatoire').max(100, '100 caractères maximum'),
  email: z.string().trim().min(1, "L'email est obligatoire").email("Format d'email invalide"),
  phone: z.string().trim().max(30, '30 caractères maximum').optional(),
  address: z.string().trim().max(255, '255 caractères maximum').optional(),
  birth_date: z.string().optional(),
  hire_date: z.string().min(1, "La date d'embauche est obligatoire"),
  department_id: z.string().min(1, 'Le département est obligatoire'),
  position: z.string().trim().min(1, 'Le poste est obligatoire').max(100, '100 caractères maximum'),
  salary: z.coerce
    .number({ invalid_type_error: 'Le salaire doit être un nombre' })
    .min(0, 'Le salaire doit être positif'),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  annual_leave_balance: z.coerce
    .number({ invalid_type_error: 'Le solde doit être un nombre' })
    .min(0, 'Le solde doit être positif')
    .max(365, '365 jours maximum'),
})
  .refine((data) => !data.birth_date || data.birth_date <= getToday(), {
    message: 'La date de naissance ne peut pas être dans le futur',
    path: ['birth_date'],
  })
  .superRefine(hireDateCheck);

export const myAgentProfileSchema = z
  .object({
    first_name: z.string().trim().min(1, 'Le prénom est obligatoire').max(100, '100 caractères maximum'),
    last_name: z.string().trim().min(1, 'Le nom est obligatoire').max(100, '100 caractères maximum'),
    email: z.string().trim().min(1, "L'email est obligatoire").email("Format d'email invalide"),
    phone: z.string().trim().max(30, '30 caractères maximum').optional().or(z.literal('')),
    address: z.string().trim().max(255, '255 caractères maximum').optional().or(z.literal('')),
    birth_date: z.string().optional().or(z.literal('')),
    hire_date: z.string().min(1, "La date d'embauche est obligatoire"),
    department_id: z.string().min(1, 'Le département est obligatoire'),
    position: z.string().trim().min(1, 'Le poste est obligatoire').max(100, '100 caractères maximum'),
  })
  // Miroir de cleanAgentData (backend) : une date de naissance ne peut pas être future.
  .refine((data) => !data.birth_date || data.birth_date <= getToday(), {
    message: 'La date de naissance ne peut pas être dans le futur',
    path: ['birth_date'],
  })
  // SEC-19 : même cohérence de dates que la création par un ADMIN.
  .superRefine(hireDateCheck);

export const departmentSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(100, '100 caractères maximum'),
  description: z.string().trim().max(255, '255 caractères maximum').optional(),
});

const attendanceBase = z.object({
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'LEAVE']),
  check_in: z.string().optional(),
  check_out: z.string().optional(),
});

// Règle partagée : heure d'arrivée obligatoire et cohérente, sauf pour ABSENT/LEAVE
const attendanceTimesCheck = (data, ctx) => {
  if (data.status === 'PRESENT' || data.status === 'LATE') {
    if (!data.check_in) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['check_in'],
        message: "L'heure d'arrivée est obligatoire",
      });
    }
    if (data.check_in && data.check_out && data.check_out <= data.check_in) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['check_out'],
        message: "Doit être après l'heure d'arrivée",
      });
    }
  }
};

export const attendanceUpdateSchema = attendanceBase.superRefine(attendanceTimesCheck);

export const attendanceCreateSchema = attendanceBase
  .extend({
    agent_id: z.string().min(1, "L'agent est obligatoire"),
    attendance_date: z
      .string()
      .min(1, 'La date est obligatoire')
      .refine((v) => v <= getToday(), { message: 'La date ne peut pas être dans le futur' }),
  })
  .superRefine(attendanceTimesCheck);
export const leaveSchema = z
  .object({
    leave_type: z.enum(['PAID', 'SICK', 'MATERNITY_PATERNITY', 'UNPAID'], {
      errorMap: () => ({ message: 'Le type de congé est obligatoire' }),
    }),
    start_date: z.string().min(1, 'La date de début est obligatoire'),
    end_date: z.string().min(1, 'La date de fin est obligatoire'),
    reason: z.string().trim().min(1, 'Le motif est obligatoire').max(255, '255 caractères maximum'),
  })
  .refine((data) => data.start_date >= getToday(), {
    message: 'La date de début ne peut pas être dans le passé',
    path: ['start_date'],
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: 'Doit être après la date de début',
    path: ['end_date'],
  });
  export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(100, '100 caractères maximum'),
  email: z.string().trim().min(1, "L'email est obligatoire").email("Format d'email invalide"),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Le mot de passe actuel est obligatoire'),
    newPassword: z.string().min(6, 'Le nouveau mot de passe doit contenir au moins 6 caractères'),
    confirmPassword: z.string().min(1, 'Veuillez confirmer le nouveau mot de passe'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });
  export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "L'email est obligatoire").email("Format d'email invalide"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Adresse email invalide.'),
  code: z.string().length(6, 'Le code doit contenir 6 chiffres.'),
  newPassword: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas.',
  path: ['confirmPassword'],
});
