import type { Metadata } from "next";

import { GlobeIcon } from "@/assets/icons";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { getTranslations } from "next-intl/server";
import DatePickerOne from "@/components/FormElements/DatePicker/DatePickerOne";
import DatePickerTwo from "@/components/FormElements/DatePicker/DatePickerTwo";
import InputGroup from "@/components/FormElements/InputGroup";
import { TextAreaGroup } from "@/components/FormElements/InputGroup/TextArea";
import MultiSelect from "@/components/FormElements/MultiSelect";
import { Checkbox } from "@/components/FormElements/checkbox";
import { RadioInput } from "@/components/FormElements/radio";
import { Select } from "@/components/FormElements/select";
import { Switch } from "@/components/FormElements/switch";
import { ShowcaseSection } from "@/components/Layouts/ShowcaseSection";

export const metadata: Metadata = {
  title: "Form Elements",
};

export default async function FormElementsPage() {
  const t = await getTranslations('Forms');
  const countries = await getTranslations('Countries');

  return (
    <>
      <Breadcrumb pageName={t('elements')} />

      <div className="grid grid-cols-1 gap-9 sm:grid-cols-2">
        <div className="flex flex-col gap-9">
          <ShowcaseSection title={t('inputFields')} className="space-y-5.5 !p-6.5">
            <InputGroup
              label={t('defaultInput')}
              placeholder={t('placeholders.defaultInputText')}
              type="text"
            />

            <InputGroup
              label={t('activeInput')}
              placeholder={t('placeholders.activeInputText')}
              active
              type="text"
            />

            <InputGroup
              label={t('disabledInput')}
              placeholder={t('placeholders.disabledInputText')}
              type="text"
              disabled
            />
          </ShowcaseSection>

          <ShowcaseSection
            title={t('toggleSwitchInput')}
            className="space-y-5.5 !p-6.5"
          >
            <Switch />
            <Switch backgroundSize="sm" />
            <Switch withIcon />
            <Switch background="dark" />
          </ShowcaseSection>

          <ShowcaseSection title={t('timeAndDate')} className="space-y-5.5 !p-6.5">
            <DatePickerOne />
            <DatePickerTwo />
          </ShowcaseSection>

          <ShowcaseSection title={t('fileUpload')} className="space-y-5.5 !p-6.5">
            <InputGroup
              type="file"
              fileStyleVariant="style1"
              label={t('attachFile')}
              placeholder={t('attachFile')}
            />

            <InputGroup
              type="file"
              fileStyleVariant="style2"
              label={t('attachFile')}
              placeholder={t('attachFile')}
            />
          </ShowcaseSection>
        </div>

        <div className="flex flex-col gap-9">
          <ShowcaseSection title={t('textareaFields')} className="space-y-6 !p-6.5">
            <TextAreaGroup
              label={t('defaultTextarea')}
              placeholder={t('placeholders.defaultTextarea')}
            />

            <TextAreaGroup
              label={t('activeTextarea')}
              placeholder={t('placeholders.activeTextarea')}
              active
            />

            <TextAreaGroup
              label={t('disabledTextarea')}
              placeholder={t('placeholders.disabledTextarea')}
              disabled
            />
          </ShowcaseSection>

          <ShowcaseSection title={t('selectInput')} className="space-y-5.5 !p-6.5">
            <Select
              label={t('selectCountry')}
              items={[
                { label: countries('unitedStates'), value: "USA" },
                { label: countries('unitedKingdom'), value: "UK" },
                { label: countries('canada'), value: "Canada" },
              ]}
              defaultValue="USA"
              prefixIcon={<GlobeIcon />}
            />
            <MultiSelect id="multiSelect" />
          </ShowcaseSection>

          <ShowcaseSection
            title={t('checkboxAndRadio')}
            className="space-y-5.5 !p-6.5"
          >
            <Checkbox label={t('checkboxText')} />
            <Checkbox label={t('checkboxText')} withIcon="check" />
            <Checkbox label={t('checkboxText')} withIcon="x" />
            <RadioInput label={t('checkboxText')} />
            <RadioInput label={t('checkboxText')} variant="circle" />
          </ShowcaseSection>
        </div>
      </div>
    </>
  );
}
