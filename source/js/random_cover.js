const covers = [
    "/img/covers/enterprise_1.jpg",
    "/img/covers/enterprise_2.jpg",
    "/img/covers/enterprise_3.jpg",
    "/img/covers/enterprise_4.jpg"
]

const randomCover =
    covers[Math.floor(Math.random() * covers.length)]

document.addEventListener("DOMContentLoaded", function () {

    const header = document.getElementById("page-header")

    if(header){
        header.style.backgroundImage =
            `url(${randomCover})`
    }

})