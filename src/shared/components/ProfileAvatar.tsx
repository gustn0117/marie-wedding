interface ProfileAvatarProps {
  profileImage?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-9 h-9 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-xl',
};

export default function ProfileAvatar({ profileImage, name, size = 'md', className = '' }: ProfileAvatarProps) {
  const sizeClass = sizeMap[size];
  const imageUrl = profileImage
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profileImage}`
    : null;

  return (
    <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-primary/10 flex items-center justify-center">
          <span className="text-primary font-bold">{name.charAt(0)}</span>
        </div>
      )}
    </div>
  );
}
