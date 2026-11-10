import Link from "next/link";
import { 
  getAppName, 
  getCompanyName, 
  getSocialLinks, 
  getContactEmail,
  appConfig 
} from "@/config";

export function Footer() {
  const appName = getAppName();
  const companyName = getCompanyName();
  const socialLinks = getSocialLinks();
  const contactEmail = getContactEmail();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          
          {/* Informações da empresa */}
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold text-dark dark:text-white">
              {companyName}
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {appConfig.company.description}
            </p>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              {appConfig.company.tagline}
            </p>
            
            {/* Informações de contato */}
            <div className="mt-6 space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Email:</strong>{" "}
                <Link 
                  href={`mailto:${contactEmail}`}
                  className="text-primary hover:underline"
                >
                  {contactEmail}
                </Link>
              </p>
              {appConfig.contact.phone && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Telefone:</strong> {appConfig.contact.phone}
                </p>
              )}
              {appConfig.company.address && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Endereço:</strong>{" "}
                  {appConfig.company.address.street}, {appConfig.company.address.city} - {appConfig.company.address.state}, {appConfig.company.address.zipCode}
                </p>
              )}
            </div>
          </div>

          {/* Links úteis */}
          <div>
            <h3 className="text-lg font-semibold text-dark dark:text-white">
              Links Úteis
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link 
                  href={appConfig.urls.docs}
                  className="text-sm text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                >
                  Documentação
                </Link>
              </li>
              <li>
                <Link 
                  href={appConfig.urls.support}
                  className="text-sm text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                >
                  Suporte
                </Link>
              </li>
              {appConfig.urls.blog && (
                <li>
                  <Link 
                    href={appConfig.urls.blog}
                    className="text-sm text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Blog
                  </Link>
                </li>
              )}
              {appConfig.urls.status && (
                <li>
                  <Link 
                    href={appConfig.urls.status}
                    className="text-sm text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Status
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Redes sociais */}
          <div>
            <h3 className="text-lg font-semibold text-dark dark:text-white">
              Redes Sociais
            </h3>
            <div className="mt-4 space-y-2">
              {socialLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                >
                  {link.name} {link.username && `(${link.username})`}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Linha de copyright e legal */}
        <div className="mt-8 border-t border-stroke pt-8 dark:border-dark-3">
          <div className="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
            <div className="text-center md:text-left">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                © {currentYear} {appConfig.company.legalName || companyName}. Todos os direitos reservados.
              </p>
              {appConfig.app.version && (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {appName} v{appConfig.app.version}
                </p>
              )}
            </div>
            
            <div className="flex space-x-6">
              <Link 
                href={appConfig.urls.privacy}
                className="text-sm text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
              >
                Política de Privacidade
              </Link>
              <Link 
                href={appConfig.urls.terms}
                className="text-sm text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
              >
                Termos de Uso
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}