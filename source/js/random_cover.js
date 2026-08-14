(function(){

const covers = [
    /*"/img/covers/enterprise_4.jpg",*/
    "/img/covers/enterprise_2.jpg",
    "/img/covers/enterprise_3.jpg",
    "/img/covers/enterprise_1.jpg"
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