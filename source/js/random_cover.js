(function(){

const covers = [
    "/azur_blog/img/covers/enterprise_2.jpg",
    "/azur_blog/img/covers/enterprise_3.jpg",
    "/azur_blog/img/covers/enterprise_1.jpg"
];


const randomCover =
    covers[Math.floor(Math.random() * covers.length)];


function setCover(){

    const header=document.getElementById("page-header");

    if(header){

        header.style.backgroundImage =
        `url("${randomCover}")`;

    }

}


document.addEventListener(
"DOMContentLoaded",
setCover
);


setTimeout(
setCover,
1000
);


})();