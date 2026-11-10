import InputGroup from "@/components/FormElements/InputGroup";
import { TextAreaGroup } from "@/components/FormElements/InputGroup/TextArea";
import { Select } from "@/components/FormElements/select";
import { ShowcaseSection } from "@/components/Layouts/ShowcaseSection";
import { useTranslations } from "next-intl";

export function ContactForm() {
  const t = useTranslations('Forms');
  const countries = useTranslations('Countries');

  return (
    <ShowcaseSection title={t('contactForm')} className="!p-6.5">
      <form action="#">
        <div className="mb-4.5 flex flex-col gap-4.5 xl:flex-row">
          <InputGroup
            label={t('labels.firstName')}
            type="text"
            placeholder={t('enterFirstName')}
            className="w-full xl:w-1/2"
          />

          <InputGroup
            label={t('labels.lastName')}
            type="text"
            placeholder={t('enterLastName')}
            className="w-full xl:w-1/2"
          />
        </div>

        <InputGroup
          label={t('labels.email')}
          type="email"
          placeholder={t('enterEmailAddress')}
          className="mb-4.5"
          required
        />

        <InputGroup
          label={t('labels.subject')}
          type="text"
          placeholder={t('enterSubject')}
          className="mb-4.5"
        />

        <Select
          label={t('labels.subject')}
          placeholder={t('selectSubject')}
          className="mb-4.5"
          items={[
            { label: countries('unitedStates'), value: "USA" },
            { label: countries('unitedKingdom'), value: "UK" },
            { label: countries('canada'), value: "Canada" },
          ]}
        />

        <TextAreaGroup label={t('labels.message')} placeholder={t('typeMessage')} />

        <button className="mt-6 flex w-full justify-center rounded-lg bg-primary p-[13px] font-medium text-white hover:bg-opacity-90">
          {t('sendMessage')}
        </button>
      </form>
    </ShowcaseSection>
  );
}
