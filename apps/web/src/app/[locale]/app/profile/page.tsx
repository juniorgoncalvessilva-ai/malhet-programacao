"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { useState } from "react";
import { CameraIcon } from "./_components/icons";
import { SocialAccounts } from "./_components/social-accounts";

export default function Page() {
  const { user, isLoaded } = useUser();
  const t = useTranslations('Profile');
  const [data, setData] = useState({
    coverPhoto: "/images/cover/cover-01.png",
  });

  if (!isLoaded) {
    return (
      <div className="mx-auto w-full max-w-[970px]">
        <Breadcrumb pageName={t('title')} />
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  const handleChange = (e: any) => {
    if (e.target.name === "coverPhoto") {
      const file = e.target?.files[0];

      setData({
        ...data,
        coverPhoto: file && URL.createObjectURL(file),
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[970px]">
      <Breadcrumb pageName="Profile" />

      <div className="overflow-hidden rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="relative z-20 h-35 md:h-65">
          <Image
            src={data?.coverPhoto}
            alt={t('profileCover')}
            className="h-full w-full rounded-tl-[10px] rounded-tr-[10px] object-cover object-center"
            width={970}
            height={260}
            style={{
              width: "auto",
              height: "auto",
            }}
          />
          <div className="absolute bottom-1 right-1 z-10 xsm:bottom-4 xsm:right-4">
            <label
              htmlFor="cover"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-[15px] py-[5px] text-body-sm font-medium text-white hover:bg-opacity-90"
            >
              <input
                type="file"
                name="coverPhoto"
                id="coverPhoto"
                className="sr-only"
                onChange={handleChange}
                accept="image/png, image/jpg, image/jpeg"
              />

              <CameraIcon />

              <span>{t('edit')}</span>
            </label>
          </div>
        </div>
        <div className="px-4 pb-6 text-center lg:pb-8 xl:pb-11.5">
          <div className="relative z-30 mx-auto -mt-22 h-30 w-full max-w-30 rounded-full bg-white/20 p-1 backdrop-blur sm:h-44 sm:max-w-[176px] sm:p-3">
            <div className="relative drop-shadow-2">
              <Image
                src={user?.imageUrl || "/images/user/user-03.png"}
                width={160}
                height={160}
                className="overflow-hidden rounded-full"
                alt="profile"
              />

              <button
                onClick={() => window.open(user?.imageUrl || "#", "_blank")}
                className="absolute bottom-0 right-0 flex size-8.5 cursor-pointer items-center justify-center rounded-full bg-primary text-white hover:bg-opacity-90 sm:bottom-2 sm:right-2"
                title={t('viewFullImage')}
              >
                <CameraIcon />
              </button>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="mb-1 text-heading-6 font-bold text-dark dark:text-white">
              {user?.fullName || t('user')}
            </h3>
            <p className="font-medium">{user?.primaryEmailAddress?.emailAddress || t('noEmail')}</p>
            <div className="mx-auto mb-5.5 mt-5 grid max-w-[370px] grid-cols-3 rounded-[5px] border border-stroke py-[9px] shadow-1 dark:border-dark-3 dark:bg-dark-2 dark:shadow-card">
              <div className="flex flex-col items-center justify-center gap-1 border-r border-stroke px-4 dark:border-dark-3 xsm:flex-row">
                <span className="font-medium text-dark dark:text-white">
                  259
                </span>
                <span className="text-body-sm">{t('posts')}</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1 border-r border-stroke px-4 dark:border-dark-3 xsm:flex-row">
                <span className="font-medium text-dark dark:text-white">
                  129K
                </span>
                <span className="text-body-sm">{t('followers')}</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1 px-4 xsm:flex-row">
                <span className="font-medium text-dark dark:text-white">
                  2K
                </span>
                <span className="text-body-sm-sm">{t('following')}</span>
              </div>
            </div>

            <div className="mx-auto max-w-[720px]">
              <h4 className="font-medium text-dark dark:text-white">
                {t('aboutMe')}
              </h4>
              <p className="mt-4">
                {user?.publicMetadata?.bio as string || t('defaultBio')}
              </p>
              
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-2 p-4 dark:bg-dark-2">
                  <h5 className="font-medium text-dark dark:text-white">{t('memberSince')}</h5>
                  <p className="text-sm text-gray-6">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : t('unknown')}
                  </p>
                </div>
                
                <div className="rounded-lg bg-gray-2 p-4 dark:bg-dark-2">
                  <h5 className="font-medium text-dark dark:text-white">{t('lastActive')}</h5>
                  <p className="text-sm text-gray-6">
                    {user?.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString() : t('unknown')}
                  </p>
                </div>
              </div>
            </div>

            <SocialAccounts />
          </div>
        </div>
      </div>
    </div>
  );
}
