"use client";

import { FormInput, AddressForm } from "@/components/FormElements/enhanced";
import { useFormValidation } from "@/hooks/useFormValidation";
import { 
  userRegistrationSchema, 
  contactSchema, 
  loginSchema, 
  userProfileSchema, 
  addressSchema 
} from "@/schemas";
import type { 
  UserRegistrationFormData, 
  ContactFormData, 
  LoginFormData, 
  UserProfileFormData, 
  AddressFormData 
} from "@/schemas";

export default function ValidatedFormsPage() {
  // Formulário de registro de usuário
  const userForm = useFormValidation<UserRegistrationFormData>({
    schema: userRegistrationSchema,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      birthDate: new Date(),
      acceptTerms: false
    },
    onSubmit: async (data) => {
      console.log("Dados do usuário:", data);
      alert("Formulário de usuário enviado com sucesso!");
    },
    onError: (errors) => {
      console.log("Erros de validação:", errors);
    }
  });

  // Formulário de contato
  const contactForm = useFormValidation<ContactFormData>({
    schema: contactSchema,
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: ""
    },
    onSubmit: async (data) => {
      console.log("Dados de contato:", data);
      alert("Formulário de contato enviado com sucesso!");
    },
    onError: (errors) => {
      console.log("Erros de validação:", errors);
    }
  });

  // Formulário de login
  const loginForm = useFormValidation<LoginFormData>({
    schema: loginSchema,
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false
    },
    onSubmit: async (data) => {
      console.log("Dados de login:", data);
      alert("Login realizado com sucesso!");
    },
    onError: (errors) => {
      console.log("Erros de validação:", errors);
    }
  });

  // Formulário de perfil
  const profileForm = useFormValidation<UserProfileFormData>({
    schema: userProfileSchema,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      bio: "",
      website: "",
      location: ""
    },
    onSubmit: async (data) => {
      console.log("Dados do perfil:", data);
      alert("Perfil atualizado com sucesso!");
    },
    onError: (errors) => {
      console.log("Erros de validação:", errors);
    }
  });


  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-dark dark:text-white">
          Formulários Validados com Zod
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Demonstração dos componentes de formulário com validação automática usando Zod e React Hook Form.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-3">
        {/* Formulário de Login */}
        <div className="rounded-lg border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <h2 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            Login
          </h2>
          
          <form onSubmit={loginForm.handleSubmit} className="space-y-4">
            <FormInput
              name="email"
              label="Email"
              type="email"
              placeholder="seu@email.com"
              formContext={loginForm}
              helpText="Digite seu email de acesso"
            />

            <FormInput
              name="password"
              label="Senha"
              type="password"
              placeholder="Digite sua senha"
              formContext={loginForm}
              helpText="Digite sua senha"
            />

            {/* Estado do formulário */}
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Estado:
              </h3>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <p>Válido: {loginForm.formState.isValid ? "✅" : "❌"}</p>
                <p>Modificado: {loginForm.formState.isDirty ? "✅" : "❌"}</p>
                <p>Enviando: {loginForm.formState.isSubmitting ? "⏳" : "❌"}</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={!loginForm.formState.isValid || loginForm.formState.isSubmitting}
              className="w-full rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loginForm.formState.isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        {/* Formulário de Cadastro de Usuário */}
        <div className="rounded-lg border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <h2 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            Cadastro de Usuário
          </h2>
          
          <form onSubmit={userForm.handleSubmit} className="space-y-4">
            <FormInput
              name="name"
              label="Nome Completo"
              placeholder="Digite seu nome completo"
              formContext={userForm}
              helpText="Mínimo de 2 caracteres"
            />

            <FormInput
              name="email"
              label="Email"
              type="email"
              placeholder="seu@email.com"
              formContext={userForm}
              helpText="Digite um email válido"
            />

            <FormInput
              name="phone"
              label="Telefone"
              type="tel"
              placeholder="(11) 99999-9999"
              formContext={userForm}
              helpText="Formato: (XX) XXXXX-XXXX"
            />

            <FormInput
              name="password"
              label="Senha"
              type="password"
              placeholder="Digite sua senha"
              formContext={userForm}
              helpText="Min. 8 chars com maiúscula, minúscula, número e especial"
            />

            <FormInput
              name="confirmPassword"
              label="Confirmar Senha"
              type="password"
              placeholder="Confirme sua senha"
              formContext={userForm}
              helpText="Deve ser igual à senha acima"
            />

            {/* Estado do formulário */}
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Estado:
              </h3>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <p>Válido: {userForm.formState.isValid ? "✅" : "❌"}</p>
                <p>Modificado: {userForm.formState.isDirty ? "✅" : "❌"}</p>
                <p>Enviando: {userForm.formState.isSubmitting ? "⏳" : "❌"}</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={!userForm.formState.isValid || userForm.formState.isSubmitting}
              className="w-full rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {userForm.formState.isSubmitting ? "Cadastrando..." : "Cadastrar"}
            </button>
          </form>
        </div>

        {/* Formulário de Contato */}
        <div className="rounded-lg border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <h2 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            Contato
          </h2>
          
          <form onSubmit={contactForm.handleSubmit} className="space-y-4">
            <FormInput
              name="name"
              label="Nome"
              placeholder="Seu nome"
              formContext={contactForm}
              helpText="Como devemos te chamar?"
            />

            <FormInput
              name="email"
              label="Email"
              type="email"
              placeholder="seu@email.com"
              formContext={contactForm}
              helpText="Para respondermos sua mensagem"
            />

            <FormInput
              name="subject"
              label="Assunto"
              placeholder="Assunto da sua mensagem"
              formContext={contactForm}
              helpText="Mínimo de 5 caracteres"
            />

            <FormInput
              name="message"
              label="Mensagem"
              placeholder="Digite sua mensagem aqui..."
              formContext={contactForm}
              helpText="Min. 10, máx. 1000 caracteres"
            />

            {/* Estado do formulário */}
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Estado:
              </h3>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <p>Válido: {contactForm.formState.isValid ? "✅" : "❌"}</p>
                <p>Modificado: {contactForm.formState.isDirty ? "✅" : "❌"}</p>
                <p>Enviando: {contactForm.formState.isSubmitting ? "⏳" : "❌"}</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={!contactForm.formState.isValid || contactForm.formState.isSubmitting}
              className="w-full rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {contactForm.formState.isSubmitting ? "Enviando..." : "Enviar"}
            </button>
          </form>
        </div>

        {/* Formulário de Perfil */}
        <div className="rounded-lg border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <h2 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            Perfil de Usuário
          </h2>
          
          <form onSubmit={profileForm.handleSubmit} className="space-y-4">
            <FormInput
              name="name"
              label="Nome"
              placeholder="Seu nome completo"
              formContext={profileForm}
              helpText="Nome para exibição"
            />

            <FormInput
              name="email"
              label="Email"
              type="email"
              placeholder="seu@email.com"
              formContext={profileForm}
              helpText="Seu email principal"
            />

            <FormInput
              name="phone"
              label="Telefone"
              type="tel"
              placeholder="(11) 99999-9999"
              formContext={profileForm}
              helpText="Telefone (opcional)"
            />

            <FormInput
              name="website"
              label="Website"
              type="url"
              placeholder="https://seusite.com"
              formContext={profileForm}
              helpText="URL do seu site (opcional)"
            />

            <FormInput
              name="location"
              label="Localização"
              placeholder="São Paulo, SP"
              formContext={profileForm}
              helpText="Sua cidade/estado (opcional)"
            />

            <FormInput
              name="bio"
              label="Bio"
              placeholder="Conte um pouco sobre você..."
              formContext={profileForm}
              helpText="Máximo de 500 caracteres"
            />

            {/* Estado do formulário */}
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Estado:
              </h3>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <p>Válido: {profileForm.formState.isValid ? "✅" : "❌"}</p>
                <p>Modificado: {profileForm.formState.isDirty ? "✅" : "❌"}</p>
                <p>Enviando: {profileForm.formState.isSubmitting ? "⏳" : "❌"}</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={!profileForm.formState.isValid || profileForm.formState.isSubmitting}
              className="w-full rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {profileForm.formState.isSubmitting ? "Salvando..." : "Salvar Perfil"}
            </button>
          </form>
        </div>

        {/* Formulário de Endereço com Consulta Automática de CEP */}
        <AddressForm
          title="Endereço com Consulta CEP"
          submitButtonText="Salvar Endereço"
          onSubmit={async (data) => {
            console.log("Dados do endereço (com CEP):", data);
            alert("Endereço salvo com sucesso! Consulta automática de CEP funcionando.");
          }}
          onError={(errors) => {
            console.log("Erros de validação:", errors);
          }}
          autoFillFromCep={true}
        />
      </div>
    </div>
  );
}