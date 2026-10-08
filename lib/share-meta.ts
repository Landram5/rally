import type {Metadata} from 'next';
// One place for canonical + social preview metadata. Image paths resolve against metadataBase.
export function shareMetadata({title,description,path,image}:{title:string;description:string;path:string;image:string}):Metadata{
 return {title,description,alternates:{canonical:path},openGraph:{type:'website',siteName:'Rally',title,description,url:path,images:[{url:image,width:1200,height:630,alt:title}]},twitter:{card:'summary_large_image',title,description,images:[image]}};
}
